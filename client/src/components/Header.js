import { Button } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { AuthService } from '../services/auth.service'

const authService = new AuthService()

function Header(props) {
    function logout() {
        authService.logout().then(() => {
            document.location.reload()
        })
    }

    return (
        <>
            <div className='header'>
                <div className='header-nav'>
                    <div className='logo'></div>
                    <Link className='header-link' to={'/'}>
                        Главная
                    </Link>
                    <Link className='header-link' to={'/sandbox'}>
                        Песочница
                    </Link>
                    <Link className='header-link' to={'/crud-example'}>
                        Простой CRUD
                    </Link>
                </div>
                <div style={{ marginRight: 10 }}>
					<span style={{ fontSize: '14px', marginRight: 15 }}>
						Привет, {props.currentUserInfo.login}!
                        {props.currentUserInfo.role === 'admin' ? 'Ты можешь все!💪😎' : 'Смотри и радуйся🌚'}
					</span>
                    <Button size='small' onClick={logout} type='text'>
                        Выйти
                        <LogoutOutlined />
                    </Button>
                </div>
            </div>
        </>
    )
}

export default Header