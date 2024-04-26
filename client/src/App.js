import './App.css'
import Content from './components/Content'
import Footer from './components/Footer'
import Header from './components/Header'

function App(props) {
    return (
        <>
            <div className='app'>
                <Header currentUserInfo={props.currentUserInfo} />
                <Content currentUserInfo={props.currentUserInfo} />
                <Footer />
            </div>
        </>
    )
}

export default App